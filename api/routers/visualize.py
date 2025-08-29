"""
Visualization router - placeholder for testing.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/test")
async def test_visualize():
    return {"message": "Visualize router placeholder"}