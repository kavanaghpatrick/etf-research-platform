import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    
    // Test API connectivity
    const response = await fetch(`${apiUrl}/api/tickers/available`);
    const data = await response.json();
    
    return NextResponse.json({
      status: 'ok',
      apiUrl,
      tickersAvailable: data.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
    }, { status: 500 });
  }
}