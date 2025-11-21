from fastapi import FastAPI

# Create the FastAPI app instance
app = FastAPI(
    title="Stock Flow Hub API",
    description="Backend for the Inventory Management System.",
    version="1.0.0"
)

# A simple root endpoint to confirm the server is running
@app.get("/")
async def read_root():
    return {"message": "Welcome to the Stock Flow Hub API"}

# We will add our API routers here later