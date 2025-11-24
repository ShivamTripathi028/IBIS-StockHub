import asyncio
import csv
from pathlib import Path
from .session import db_client

async def main() -> None:
    """
    Wipes the database and seeds it with the complete product catalog from a CSV file.
    """
    print("--- 🚀 Starting database seed from CSV ---")
    
    await db_client.connect()

    # --- 🧹 Clean up existing data ---
    # Ensures a fresh start every time you run the seed.
    print("🧹 Cleaning up old data...")
    await db_client.orderlineitem.delete_many()
    await db_client.shipmentrequest.delete_many()
    await db_client.order.delete_many()
    await db_client.shipment.delete_many()
    await db_client.product.delete_many()
    print("✅ Cleanup complete.")

    # --- 📄 Read and Parse the CSV file ---
    products_to_create = []
    # This creates a path to 'products_db.csv' in the parent directory (server/)
    csv_file_path = Path(__file__).parent.parent / 'products_db.csv'
    print(f"📄 Reading products from {csv_file_path}...")

    try:
        with open(csv_file_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            next(reader)  # Skip the header row (SKU,Product Name)
            
            for row in reader:
                # Ensure row has at least 2 columns to avoid errors
                if len(row) >= 2:
                    sku = row[0].strip()
                    name = row[1].strip()
                    if sku and name: # Only add if both SKU and name are present
                        products_to_create.append({'sku': sku, 'name': name})
    except FileNotFoundError:
        print(f"❌ ERROR: Could not find the CSV file at {csv_file_path}")
        print("Please make sure 'products_db.csv' is in the 'server/' directory.")
        await db_client.disconnect()
        return

    # --- 📦 Seed the Product Catalog ---
    if products_to_create:
        print(f"📦 Seeding {len(products_to_create)} products into the database...")
        # Use create_many for a highly efficient bulk insert operation.
        await db_client.product.create_many(data=products_to_create)
        print(f"✅ {len(products_to_create)} products seeded successfully.")
    else:
        print("⚠️ No products found in the CSV to seed.")

    await db_client.disconnect()
    print("--- 🌱 Seeding complete ---")

if __name__ == '__main__':
    asyncio.run(main())