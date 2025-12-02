import asyncio
import csv
from pathlib import Path
from prisma import Prisma

# Initialize Prisma client
db_client = Prisma(auto_register=True)

# --- 1. CURRENT INVENTORY LIST (Processed from your shipments) ---
CURRENT_INVENTORY = {
    # First Shipment
    "100003": 3,
    "204017": 10,
    "114032": 2,
    "100067": 3,
    "115110": 5,   # Summed from multiple entries (2 + 3)
    "110052": 3,
    "100001": 3,
    "100071": 3,
    "204016": 4,   # Summed from multiple entries (2 + 2)
    "100076": 3,
    "715105": 2,
    "100046": 3,
    "910115": 10,
    "305044": 100,
    "910224": 4,
    "115145": 2,
    "920122": 10,
    "114008": 10,
    "910225": 4,
    "110081": 5,
    "114014": 8,
    "114012": 8,
    "110043": 3,
    "100028": 3,
    "205024": 2,
    "110082": 20,
    "114000": 10,
    "925034": 20,
    "925009": 5,
    "200005": 2,

    # Second Shipment - Part 1
    "100038": 3,
    "110088": 3,
    "925049": 2,
    "910396": 4,
    "100002": 3,
    "100048": 3,
    "910077": 2,
    "110091": 3,
    "110033": 3,
    "110191": 3,
    "100044": 3,
    "910253": 4,
    "910232": 4,
    "920091": 20,
    "114031": 16,
    "910114": 10,
    "100040": 3,
    "100103": 3,
    "915001": 2,
    "110087": 5,
    "910235": 4,
    "920000": 3,
    "305045": 200, # Summed from multiple entries (100 + 100)
    "110016": 3,
    "920041": 3,
    "920430": 4,
    "815069": 2,
    "110004": 3,

    # Second Shipment - Part 2
    "925053": 20,
    "920460": 5,
    "915280": 5,
    "925036": 13,  # Summed from multiple entries (8 + 5)
    "920462": 5,
    "910009": 3,
    "315050": 3,
    "410008": 3,
    "100099": 7,
    "315046": 6,
    "315052": 4,
    "305051": 20,
    "305053": 5,
    "305057": 10,
    "305061": 10,
    "105231": 15,
    "714073": 4,   # Summed from multiple entries (3 + 1)
    "515011": 4,   # Summed from multiple entries (2 + 2)
    "714031": 3,
    "715103": 3,   # Summed from multiple entries (2 + 1)
    "915039": 5,
    "200012": 3,
    "B05046": 3,
    "920034": 5,
    "920423": 5,
    "925028": 2,
    "925050": 1,
    "910033": 2,
    "920084": 2,
    "920286": 1,
    "920287": 1,
    "920160": 2,
    "105010": 2,
    "610003": 2,
    "920029": 2,
    "305055": 2,

    # Third Shipment
    "105130": 2,
    "100011": 3,
    "100015": 3,
    "910116": 5,
    "100207": 3,
    "110086": 4,
    "920437": 2,
    "100105": 3,
    "214018": 5,
    "214011": 3,
    "100090": 3,
    "714086": 2,
    "100029": 3,
    "110060": 3,
    "114035": 5,
    "110111": 3,
    "910421": 3,
    "100106": 2,
    "714082": 2,
    "100102": 2,
    "114022": 2,
    "110070": 3,
    "110077": 3,
    "100019": 9,
    "920418": 2,
    "110055": 3,
    "910252": 4,
    "110035": 5
}

async def sync_catalog_from_csv():
    """
    Reads products_db.csv and adds NEW products only.
    Existing products are left alone.
    """
    products_to_create = []
    csv_file_path = Path(__file__).parent.parent / 'products_db.csv'
    
    print(f"📄 Reading catalog from {csv_file_path}...")

    try:
        with open(csv_file_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            next(reader, None)  # Skip header
            
            for row in reader:
                if len(row) >= 2:
                    sku = row[0].strip()
                    name = row[1].strip()
                    
                    if sku and name:
                        # Prepare the product object
                        products_to_create.append({
                            'sku': sku,
                            'name': name,
                            'quantityInStock': 0 # Default to 0 for new items
                        })

        if products_to_create:
            print(f"📦 Found {len(products_to_create)} products in CSV. Syncing...")
            
            # skip_duplicates=True ensures we don't crash on existing SKUs
            # and we don't overwrite existing data.
            count = await db_client.product.create_many(
                data=products_to_create,
                skip_duplicates=True 
            )
            print(f"✅ Added {count} NEW products to the database.")
        else:
            print("⚠️ No products found in CSV.")

    except FileNotFoundError:
        print(f"❌ ERROR: Could not find {csv_file_path}")

async def update_stock_quantities():
    """
    Iterates through the CURRENT_INVENTORY dictionary and updates
    the quantities in the database.
    """
    print("🔄 Starting Stock Quantity Updates...")
    
    updated_count = 0
    not_found_count = 0

    for sku, qty in CURRENT_INVENTORY.items():
        # Find the product first
        product = await db_client.product.find_unique(where={'sku': sku})
        
        if product:
            # Update the quantity
            await db_client.product.update(
                where={'id': product.id},
                data={'quantityInStock': qty}
            )
            print(f"   Updated {sku}: Set to {qty}")
            updated_count += 1
        else:
            print(f"   ⚠️ SKU {sku} not found in database. Skipping.")
            not_found_count += 1

    print(f"✅ Stock Update Complete: {updated_count} updated, {not_found_count} skipped.")

async def main() -> None:
    print("--- 🚀 Starting Smart Seed ---")
    await db_client.connect()

    # Step 1: Ensure Catalog is complete (Non-destructive)
    await sync_catalog_from_csv()

    # Step 2: Update Specific Quantities
    if CURRENT_INVENTORY:
        await update_stock_quantities()
    else:
        print("ℹ️ No inventory updates provided in CURRENT_INVENTORY list.")

    await db_client.disconnect()
    print("--- 🌱 Process Complete ---")

if __name__ == '__main__':
    asyncio.run(main())