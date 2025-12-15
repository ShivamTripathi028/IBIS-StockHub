print("🚀 SCRIPT STARTING... (If you see this, the file is running)")

import os
import datetime
import asyncio
from dotenv import load_dotenv
from sp_api.api import Orders
from sp_api.base import Marketplaces
from app.api.orders.schemas import OrderCreate, OrderLineItemCreate
from app.api.orders import service as orders_service
from app.db.session import db_client
from prisma.enums import OrderSource

load_dotenv()

# Configuration from .env
credentials = {
    "refresh_token": os.getenv("AMAZON_REFRESH_TOKEN"),
    "lwa_app_id": os.getenv("AMAZON_CLIENT_ID"),
    "lwa_client_secret": os.getenv("AMAZON_CLIENT_SECRET"),
    "aws_access_key": os.getenv("AWS_ACCESS_KEY"),
    "aws_secret_key": os.getenv("AWS_SECRET_KEY"),
    "role_arn": os.getenv("AWS_ROLE_ARN"),
}

async def sync_amazon_orders():
    print("🔄 [Amazon Sync] Connecting to Database...")
    
    if not db_client.is_connected():
        await db_client.connect()

    try:
        print("🔌 [Amazon Sync] Connecting to Amazon API...")
        orders_client = Orders(credentials=credentials, marketplace=Marketplaces.IN)
        
        # 1. Look back 7 DAYS (to be safe)
        last_week = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
        
        # 2. Allow PENDING and UNSHIPPED (Catches everything)
        print(f"   🔎 Searching orders created after: {last_week[:10]}...")
        res = orders_client.get_orders(
            CreatedAfter=last_week, 
            OrderStatuses=["Unshipped", "PartiallyShipped", "Pending"]
        )
        amazon_orders = res.payload.get("Orders", [])
        
    except Exception as e:
        print(f"❌ [Amazon Sync] Connection Failed: {str(e)}")
        return

    if not amazon_orders:
        print("✅ [Amazon Sync] Connection Successful, but NO new orders found.")
        return

    print(f"📦 [Amazon Sync] Found {len(amazon_orders)} active orders.")
    new_count = 0

    for amz_order in amazon_orders:
        amz_order_id = amz_order["AmazonOrderId"]
        buyer_name = amz_order.get("BuyerInfo", {}).get("BuyerName", "Amazon Customer")
        status = amz_order["OrderStatus"]
        
        # 3. Check Duplicate
        customer_str = f"{buyer_name} (Amz: {amz_order_id})"
        existing = await db_client.order.find_first(where={'customerName': customer_str})
        
        if existing:
            # print(f"   ℹ️ Skipping {amz_order_id} (Already Imported)")
            continue

        print(f"   ✨ NEW ORDER FOUND: {amz_order_id} [{status}]")

        # 4. Fetch Items
        try:
            items_res = orders_client.get_order_items(order_id=amz_order_id)
            amz_items = items_res.payload.get("OrderItems", [])
        except Exception as e:
            print(f"      ⚠️ Failed to fetch items: {e}")
            continue

        line_items = []
        
        for item in amz_items:
            seller_sku = item.get("SellerSKU")
            qty = item.get("QuantityOrdered")
            
            product = await db_client.product.find_unique(where={'sku': seller_sku})
            
            if product:
                line_items.append(OrderLineItemCreate(
                    product_id=product.id,
                    quantity=qty
                ))
            else:
                print(f"      ❌ SKU '{seller_sku}' not found in DB! Skipping Order.")
                line_items = [] 
                break

        if not line_items:
            continue

        # 5. Create Order & Send WhatsApp
        try:
            payload = OrderCreate(
                customer_name=customer_str,
                source=OrderSource.Amazon,
                line_items=line_items
            )
            
            print(f"      📝 Saving to Database...")
            await orders_service.create(db_client, payload)
            
            new_count += 1
            print(f"      ✅ SUCCESS! Notification Sent.")

        except Exception as e:
            print(f"      ❌ Failed to save order: {e}")

    if new_count > 0:
        print(f"🏁 [Amazon Sync] Finished. Imported {new_count} orders.")
    else:
        print("🏁 [Amazon Sync] Finished. No new orders to import.")

# --- MAKE SURE YOU COPY THIS PART ---
if __name__ == "__main__":
    asyncio.run(sync_amazon_orders())