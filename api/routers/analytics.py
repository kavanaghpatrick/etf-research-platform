"""
Analytics router - placeholder for testing.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/test")
async def test_analytics():
    return {"message": "Analytics router placeholder"}