#!/usr/bin/env python3
"""
Real-time monitoring dashboard for data source health and performance.
"""

import time
import os
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.patches import Rectangle
import numpy as np

from src.data import ResilientDataFetcher
from src.utils import setup_logging


class DataSourceMonitor:
    """Monitor and visualize data source health in real-time."""
    
    def __init__(self, fetcher: ResilientDataFetcher):
        self.fetcher = fetcher
        self.fig, self.axes = plt.subplots(2, 2, figsize=(14, 10))
        self.fig.suptitle('Data Source Health Monitor', fontsize=16)
        
        # Initialize data storage
        self.health_history = {source.name: [] for source in fetcher.sources}
        self.request_times = {source.name: [] for source in fetcher.sources}
        self.success_rates = {source.name: [] for source in fetcher.sources}
        self.timestamps = []
        
    def update_data(self):
        """Update monitoring data."""
        current_time = datetime.now()
        self.timestamps.append(current_time)
        
        # Get current health status
        health_status = self.fetcher.get_source_health()
        
        for source_name in self.health_history.keys():
            if source_name in health_status:
                status = health_status[source_name]
                
                # Store health (1 for healthy, 0 for unhealthy)
                self.health_history[source_name].append(
                    1 if status['healthy'] else 0
                )
                
                # Parse and store success rate
                success_rate = float(status['success_rate'].rstrip('%')) / 100
                self.success_rates[source_name].append(success_rate)
                
                # Store average response time
                avg_time = float(status['average_response_time'].rstrip('s'))
                self.request_times[source_name].append(avg_time)
            else:
                # Source not available
                self.health_history[source_name].append(0)
                self.success_rates[source_name].append(0)
                self.request_times[source_name].append(0)
        
        # Keep only last 100 data points
        max_points = 100
        if len(self.timestamps) > max_points:
            self.timestamps = self.timestamps[-max_points:]
            for source_name in self.health_history.keys():
                self.health_history[source_name] = self.health_history[source_name][-max_points:]
                self.success_rates[source_name] = self.success_rates[source_name][-max_points:]
                self.request_times[source_name] = self.request_times[source_name][-max_points:]
    
    def animate(self, frame):
        """Animation function for real-time updates."""
        # Clear all axes
        for ax in self.axes.flat:
            ax.clear()
        
        # Update data
        self.update_data()
        
        if len(self.timestamps) < 2:
            return
        
        # Plot 1: Source Health Status (Top Left)
        ax1 = self.axes[0, 0]
        ax1.set_title('Source Health Status')
        
        y_positions = list(range(len(self.health_history)))
        current_health = self.fetcher.get_source_health()
        
        for i, (source_name, history) in enumerate(self.health_history.items()):
            if history:
                # Current status
                current_status = history[-1]
                color = 'green' if current_status == 1 else 'red'
                
                # Add status bar
                rect = Rectangle((0, i-0.4), 1, 0.8, 
                               facecolor=color, alpha=0.7)
                ax1.add_patch(rect)
                
                # Add text
                status_text = "HEALTHY" if current_status == 1 else "UNHEALTHY"
                if source_name in current_health:
                    details = current_health[source_name]
                    if details['backoff_until']:
                        status_text = f"BACKOFF"
                
                ax1.text(0.5, i, f"{source_name}: {status_text}", 
                        ha='center', va='center', fontweight='bold')
        
        ax1.set_xlim(0, 1)
        ax1.set_ylim(-0.5, len(self.health_history) - 0.5)
        ax1.set_yticks([])
        ax1.set_xticks([])
        
        # Plot 2: Success Rate Over Time (Top Right)
        ax2 = self.axes[0, 1]
        ax2.set_title('Success Rate Over Time')
        
        for source_name, rates in self.success_rates.items():
            if len(rates) > 1:
                ax2.plot(range(len(rates)), rates, label=source_name, marker='o', markersize=3)
        
        ax2.set_xlabel('Time (samples)')
        ax2.set_ylabel('Success Rate')
        ax2.set_ylim(-0.1, 1.1)
        ax2.legend(loc='lower left')
        ax2.grid(True, alpha=0.3)
        
        # Plot 3: Response Times (Bottom Left)
        ax3 = self.axes[1, 0]
        ax3.set_title('Average Response Time')
        
        for source_name, times in self.request_times.items():
            if len(times) > 1 and any(t > 0 for t in times):
                ax3.plot(range(len(times)), times, label=source_name, marker='o', markersize=3)
        
        ax3.set_xlabel('Time (samples)')
        ax3.set_ylabel('Response Time (s)')
        ax3.legend(loc='upper left')
        ax3.grid(True, alpha=0.3)
        
        # Plot 4: Current Statistics (Bottom Right)
        ax4 = self.axes[1, 1]
        ax4.set_title('Current Statistics')
        ax4.axis('off')
        
        # Create statistics table
        stats_text = "Source Statistics:\n" + "-"*30 + "\n"
        
        for source_name in self.health_history.keys():
            if source_name in current_health:
                status = current_health[source_name]
                stats_text += f"\n{source_name}:\n"
                stats_text += f"  Total Requests: {status['total_requests']}\n"
                stats_text += f"  Success Rate: {status['success_rate']}\n"
                stats_text += f"  Rate Limits Hit: {status['rate_limit_hits']}\n"
                stats_text += f"  Avg Response: {status['average_response_time']}\n"
        
        ax4.text(0.1, 0.9, stats_text, transform=ax4.transAxes, 
                fontfamily='monospace', fontsize=9, verticalalignment='top')
        
        plt.tight_layout()
    
    def start_monitoring(self):
        """Start the monitoring dashboard."""
        # Set up animation
        ani = animation.FuncAnimation(
            self.fig, 
            self.animate, 
            interval=5000,  # Update every 5 seconds
            cache_frame_data=False
        )
        
        plt.show()


def test_sources_with_monitoring():
    """Test data sources while monitoring their health."""
    print("Starting Data Source Monitor...")
    print("This will continuously fetch data and display source health.")
    print("Close the window to stop monitoring.\n")
    
    # Initialize fetcher
    fetcher = ResilientDataFetcher()
    
    # Create monitor
    monitor = DataSourceMonitor(fetcher)
    
    # Start a background thread to continuously fetch data
    import threading
    
    def fetch_loop():
        """Continuously fetch data to generate monitoring data."""
        tickers = ["SPY", "QQQ", "IWM", "AAPL", "MSFT", "GOOGL"]
        
        while True:
            try:
                # Rotate through tickers
                ticker = tickers[int(time.time()) % len(tickers)]
                
                print(f"\nFetching {ticker}...")
                data = fetcher.fetch_with_fallback(
                    ticker,
                    datetime.now() - timedelta(days=5),
                    datetime.now()
                )
                
                if not data.empty:
                    print(f"✓ Got {len(data)} days for {ticker}")
                else:
                    print(f"✗ Failed to get data for {ticker}")
                
                # Small delay between requests
                time.sleep(2)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error in fetch loop: {e}")
                time.sleep(5)
    
    # Start background fetching
    fetch_thread = threading.Thread(target=fetch_loop, daemon=True)
    fetch_thread.start()
    
    # Start monitoring dashboard
    monitor.start_monitoring()


def main():
    """Run the monitoring dashboard."""
    setup_logging()
    
    print("\n" + "="*60)
    print("DATA SOURCE MONITORING DASHBOARD")
    print("="*60)
    
    try:
        test_sources_with_monitoring()
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user.")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()