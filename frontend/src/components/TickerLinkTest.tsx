'use client'

import { TickerLink, TickerButton, TickerBadge, InlineTickerLink, TickerText } from './TickerLink'

/**
 * Test component to verify TickerLink implementation
 * This component demonstrates all variants and features
 */
export default function TickerLinkTest() {
  const handleTickerClick = (ticker: string) => {
    console.log(`Ticker clicked: ${ticker}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">TickerLink Component Test</h1>
        <p className="text-gray-600">Testing all variants and mobile responsiveness</p>
      </div>

      {/* Variant Examples */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Component Variants</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Default</h3>
            <TickerLink ticker="AAPL" onClick={handleTickerClick} />
            <TickerLink ticker="MSFT" size="sm" onClick={handleTickerClick} />
            <TickerLink ticker="GOOGL" size="lg" onClick={handleTickerClick} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Button</h3>
            <TickerButton ticker="SPY" onClick={handleTickerClick} />
            <TickerButton ticker="QQQ" size="sm" onClick={handleTickerClick} />
            <TickerButton ticker="VTI" size="lg" onClick={handleTickerClick} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Badge</h3>
            <TickerBadge ticker="TSLA" onClick={handleTickerClick} />
            <TickerBadge ticker="NVDA" size="sm" onClick={handleTickerClick} />
            <TickerBadge ticker="META" size="lg" onClick={handleTickerClick} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Inline</h3>
            <InlineTickerLink ticker="AMZN" onClick={handleTickerClick} />
            <InlineTickerLink ticker="NFLX" size="sm" onClick={handleTickerClick} />
            <InlineTickerLink ticker="DIS" size="lg" onClick={handleTickerClick} />
          </div>
        </div>
      </section>

      {/* Text Parsing Example */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Automatic Text Parsing</h2>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Input Text:</h3>
            <p className="text-sm text-gray-600 font-mono">
              "I own AAPL and MSFT stocks, plus some SPY ETF for diversification."
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Parsed Result:</h3>
            <TickerText className="text-sm">
              I own AAPL and MSFT stocks, plus some SPY ETF for diversification.
            </TickerText>
          </div>
        </div>
      </section>

      {/* Mobile Test Section */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mobile Touch Targets</h2>
        <p className="text-sm text-gray-600 mb-4">
          All buttons below meet the minimum 44px touch target requirement for mobile accessibility.
        </p>
        <div className="flex flex-wrap gap-3">
          <TickerButton ticker="AAPL" size="md" />
          <TickerButton ticker="MSFT" size="md" />
          <TickerButton ticker="GOOGL" size="md" />
          <TickerBadge ticker="SPY" size="md" />
          <TickerBadge ticker="QQQ" size="md" />
          <TickerBadge ticker="VTI" size="md" />
        </div>
      </section>

      {/* Accessibility Features */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Accessibility Features</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Custom ARIA Labels</h3>
              <TickerLink 
                ticker="AAPL" 
                ariaLabel="View detailed Apple Inc. stock analysis and charts"
                className="inline-block"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Disabled State</h3>
              <TickerButton ticker="DISABLED" disabled />
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Keyboard Navigation</h3>
            <p className="text-sm text-gray-600">
              Use Tab to navigate between links, Enter to activate, and focus indicators are visible.
            </p>
          </div>
        </div>
      </section>

      {/* Integration Examples */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Examples</h2>
        
        {/* Table Example */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">In Data Tables</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { symbol: 'AAPL', price: '$175.23', change: '+2.45%' },
                  { symbol: 'MSFT', price: '$415.67', change: '-1.23%' },
                  { symbol: 'GOOGL', price: '$142.89', change: '+0.87%' }
                ].map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <TickerLink ticker={row.symbol} size="sm" />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.price}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card Example */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">In Summary Cards</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {['AAPL', 'MSFT', 'GOOGL'].map((ticker) => (
              <div key={ticker} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <TickerLink ticker={ticker} variant="default" size="md" className="font-semibold" />
                  <TickerBadge ticker="ETF" size="sm" disabled />
                </div>
                <p className="text-sm text-gray-600">Stock price data and analysis</p>
                <div className="mt-3">
                  <TickerButton ticker={ticker} size="sm" displayText="View Details" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}