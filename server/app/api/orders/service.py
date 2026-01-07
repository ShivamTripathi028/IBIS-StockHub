import os
import aiohttp
import asyncio
from prisma import Prisma
from prisma.enums import OrderStatus
from .schemas import OrderCreate

# --- NOTIFICATION HELPER ---
async def send_whatsapp_notification(order):
    """
    Sends a strictly professional WhatsApp notification.
    Shows SKU, Description, and Quantity with BOLD labels.
    """
    token = os.getenv("WHATSAPP_TOKEN")
    phone_id = os.getenv("WHATSAPP_PHONE_ID")
    recipient = os.getenv("WHATSAPP_RECIPIENT")

    if not all([token, phone_id, recipient]):
        print("⚠️ WhatsApp keys missing in .env - Skipping notification.")
        return

    # 1. Build the Item Details String
    items_list = ""
    
    for line in order.lineItems:
        prod = line.product
        
        # Added asterisks around labels to make them BOLD
        items_list += (
            f"*SKU:* {prod.sku}\n"
            f"*Item Description:* {prod.name}\n"
            f"*Quantity:* {line.quantity}\n"
            f"--------------------------------\n"
        )

    # 2. Construct the Message Body
    message_body = (
        f"*NEW ORDER NOTIFICATION*\n"
        f"========================\n"
        f"Customer: {order.customerName}\n"
        f"Order ID: {order.id}\n\n"
        f"ORDER DETAILS\n"
        f"========================\n"
        f"{items_list}"
    )

    url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # --- FIXED: Defined payload here ---
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {
            "body": message_body
        }
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as response:
                if response.status == 200:
                    print(f"✅ WhatsApp Alert Sent for Order {order.id}")
                else:
                    body = await response.text()
                    print(f"❌ WhatsApp Failed: {body}")
    except Exception as e:
        print(f"❌ WhatsApp Error: {str(e)}")


# --- CORE SERVICE LOGIC ---

async def get_all(db: Prisma, status: OrderStatus | None = None):
    query = {}
    if status:
        query['where'] = {'status': status}
    
    return await db.order.find_many(
        include={
            'lineItems': {
                'include': {
                    'product': True
                }
            }
        },
        order={'createdAt': 'desc'},
        **query
    )

async def get_by_id(db: Prisma, order_id: str):
    return await db.order.find_unique(
        where={'id': order_id},
        include={'lineItems': {'include': {'product': True}}}
    )

async def create(db: Prisma, order_data: OrderCreate):
    async with db.tx() as transaction:
        can_fulfill_all = True
        for item in order_data.line_items:
            product = await transaction.product.find_unique(where={'id': item.product_id})
            # Check if stock is sufficient
            if not product or product.quantityInStock < item.quantity:
                can_fulfill_all = False
                break
        
        initial_status = OrderStatus.READY_TO_SHIP if can_fulfill_all else OrderStatus.AWAITING_STOCK
        
        # LOGIC FIX: If we can fulfill immediately, DEDUCT STOCK NOW (Reserve it)
        if initial_status == OrderStatus.READY_TO_SHIP:
            for item in order_data.line_items:
                await transaction.product.update(
                    where={'id': item.product_id},
                    data={'quantityInStock': {'decrement': item.quantity}}
                )

        new_order = await transaction.order.create(
            data={
                'customerName': order_data.customer_name,
                'source': order_data.source,
                'status': initial_status
            }
        )
        
        for item in order_data.line_items:
            await transaction.orderlineitem.create(
                data={
                    'orderId': new_order.id,
                    'productId': item.product_id,
                    'quantity': item.quantity
                }
            )
            
    # Fetch complete order with products
    created_order = await get_by_id(db, new_order.id)

    # --- NOTIFICATION ---
    await send_whatsapp_notification(created_order)
    # --------------------

    return created_order

async def complete_order(db: Prisma, order_id: str):
    order_to_complete = await get_by_id(db, order_id)
    if not order_to_complete:
        return None

    if order_to_complete.status != OrderStatus.READY_TO_SHIP:
        raise ValueError("Order is not in a state that can be completed.")

    async with db.tx() as transaction:
        # LOGIC FIX: Do NOT deduct stock here. 
        # Stock was already deducted when status became READY_TO_SHIP.
        
        await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.COMPLETED}
        )
    
    return await get_by_id(db, order_id)

async def cancel_order(db: Prisma, order_id: str):
    order = await get_by_id(db, order_id)
    if not order:
        return None

    async with db.tx() as transaction:
        # LOGIC FIX: If the order reserved stock, give it back.
        # This applies to READY_TO_SHIP and ON_HOLD.
        if order.status in [OrderStatus.READY_TO_SHIP, OrderStatus.ON_HOLD]:
            for item in order.lineItems:
                await transaction.product.update(
                    where={'id': item.productId},
                    data={'quantityInStock': {'increment': item.quantity}}
                )

        return await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.CANCELLED},
            include={'lineItems': {'include': {'product': True}}}
        )

async def hold_order(db: Prisma, order_id: str):
    # Stock remains reserved (deducted) while ON_HOLD
    return await db.order.update(
        where={'id': order_id},
        data={'status': OrderStatus.ON_HOLD},
        include={'lineItems': {'include': {'product': True}}}
    )

async def resume_order(db: Prisma, order_id: str):
    # Just update status back to READY. Stock is already reserved.
    return await db.order.update(
        where={'id': order_id},
        data={'status': OrderStatus.READY_TO_SHIP},
        include={'lineItems': {'include': {'product': True}}}
    )

async def allocate_order(db: Prisma, order_id: str):
    """
    Attempts to allocate stock to an AWAITING_STOCK order.
    If stock is available, it reserves (deducts) it and moves to READY_TO_SHIP.
    """
    order = await get_by_id(db, order_id)
    if not order:
        return None
    
    if order.status != OrderStatus.AWAITING_STOCK:
        raise ValueError("Only orders awaiting stock can be allocated.")

    async with db.tx() as transaction:
        # 1. Check if we have enough stock for ALL items
        for item in order.lineItems:
            product = await transaction.product.find_unique(where={'id': item.productId})
            if not product:
                raise ValueError(f"Product {item.productId} not found")
            
            if product.quantityInStock < item.quantity:
                raise ValueError(f"Insufficient stock for {product.sku}. Needed: {item.quantity}, Available: {product.quantityInStock}")

        # 2. If we are here, stock is good. Reserve it.
        for item in order.lineItems:
            await transaction.product.update(
                where={'id': item.productId},
                data={'quantityInStock': {'decrement': item.quantity}}
            )

        # 3. Update Status
        return await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.READY_TO_SHIP},
            include={'lineItems': {'include': {'product': True}}}
        )