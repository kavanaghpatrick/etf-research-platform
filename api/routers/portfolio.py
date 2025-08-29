"""
Portfolio optimization router - placeholder for testing.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/test")
async def test_portfolio():
    return {"message": "Portfolio router placeholder"}