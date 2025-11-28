from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from prisma import Prisma
from app.db.session import db_client
from . import service
from .schemas import Product, ProductCreate

router = APIRouter()

@router.post("", response_model=Product, status_code=201)
async def create_new_product(
    product: ProductCreate, 
    db: Prisma = Depends(lambda: db_client)
):
    """
    Create a new product.
    """
    existing_product = await service.get_by_sku(db, sku=product.sku)
    if existing_product:
        raise HTTPException(
            status_code=409, 
            detail=f"Product with SKU '{product.sku}' already exists."
        )
    return await service.create(db, product)

# --- UPDATED ENDPOINT ---
@router.get("", response_model=List[Product])
async def get_all_products_route(
    search: Optional[str] = Query(None), # Capture ?search=... from URL
    db: Prisma = Depends(lambda: db_client)
):
    """
    Get a list of products. 
    If 'search' is provided, filters by Name OR SKU.
    """
    return await service.get_all(db, search_query=search)