import asyncio
import csv
import os
from pathlib import Path
from prisma import Prisma

# Initialize Prisma client
db = Prisma(auto_register=True)

CSV_FILENAME = "shopify-all-rak-products.csv"

def clean_title(raw_title: str) -> str:
    parts = [p.strip() for p in raw_title.split('|')]
    return " | ".join(parts[:2])

def format_product_name(row: dict) -> str:
    # 1. Base Title
    base_title = clean_title(row.get('Title', ''))
    final_name_parts = [base_title]

    # 2. Iterate through Option 1, 2, 3
    for i in range(1, 4):
        opt_name = row.get(f'Option{i} Name')
        opt_val = row.get(f'Option{i} Value')

        if opt_name and opt_val and opt_name != 'Title' and opt_val != 'Default Title':
            final_name_parts.append(f"{opt_name} - {opt_val}")

    return " | ".join(final_name_parts)

async def main() -> None:
    print("--- 🚀 Starting Hard Reset Import ---")
    await db.connect()

    # 1. LOCATE CSV
    base_dir = Path(__file__).parent.parent.parent 
    csv_path = base_dir / CSV_FILENAME

    if not csv_path.exists():
        print(f"❌ ERROR: Could not find {CSV_FILENAME}")
        await db.disconnect()
        return

    # 2. CLEAR OLD DATA
    print("🗑️  Clearing old database entries...")
    await db.orderlineitem.delete_many()
    await db.shipmentrequest.delete_many()
    deleted_count = await db.product.delete_many()
    print(f"   Deleted {deleted_count} old products.")

    # 3. PARSE CSV
    processed_skus = set()
    products_to_create = []

    print(f"📄 Reading {csv_path}...")

    try:
        with open(csv_path, mode='r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                raw_sku = row.get('SKU', '').strip()

                if not raw_sku: continue 
                if raw_sku in processed_skus: continue 
                
                processed_skus.add(raw_sku)

                full_name = format_product_name(row)

                products_to_create.append({
                    'sku': raw_sku,
                    'name': full_name,
                    'quantityInStock': 0,
                    # [FIX] Removed 'category' field to prevent schema mismatch error
                })

        print(f"📦 Found {len(products_to_create)} unique valid products.")

        # 4. INSERT NEW DATA
        if products_to_create:
            print("💾 Writing to database...")
            count = await db.product.create_many(
                data=products_to_create,
                skip_duplicates=True 
            )
            print(f"✅ Successfully seeded {count} products with 0 stock.")
        else:
            print("⚠️ No valid products found to import.")

    except Exception as e:
        print(f"❌ Critical Error: {e}")

    await db.disconnect()
    print("--- 🌱 Process Complete ---")

if __name__ == '__main__':
    asyncio.run(main())