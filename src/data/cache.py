import os
import pickle
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Any
import logging
from pathlib import Path


class DataCache:
    """Simple file-based cache for ETF data."""
    
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        
    def _get_cache_path(self, key: str) -> Path:
        """Get the file path for a cache key."""
        safe_key = key.replace("/", "_").replace("\\", "_")
        return self.cache_dir / f"{safe_key}.pkl"
    
    def set(self, key: str, data: Any, ttl_hours: int = 24) -> None:
        """Store data in cache with time-to-live."""
        cache_data = {
            "data": data,
            "timestamp": datetime.now(),
            "ttl_hours": ttl_hours
        }
        
        try:
            cache_path = self._get_cache_path(key)
            with open(cache_path, "wb") as f:
                pickle.dump(cache_data, f)
            self.logger.debug(f"Cached data for key: {key}")
        except Exception as e:
            self.logger.error(f"Error caching data for {key}: {str(e)}")
    
    def get(self, key: str) -> Optional[Any]:
        """Retrieve data from cache if not expired."""
        cache_path = self._get_cache_path(key)
        
        if not cache_path.exists():
            return None
        
        try:
            with open(cache_path, "rb") as f:
                cache_data = pickle.load(f)
            
            timestamp = cache_data["timestamp"]
            ttl_hours = cache_data["ttl_hours"]
            
            if datetime.now() - timestamp > timedelta(hours=ttl_hours):
                self.logger.debug(f"Cache expired for key: {key}")
                cache_path.unlink()  # Delete expired cache
                return None
            
            self.logger.debug(f"Cache hit for key: {key}")
            return cache_data["data"]
            
        except Exception as e:
            self.logger.error(f"Error reading cache for {key}: {str(e)}")
            return None
    
    def invalidate(self, key: str) -> None:
        """Remove a specific key from cache."""
        cache_path = self._get_cache_path(key)
        if cache_path.exists():
            cache_path.unlink()
            self.logger.debug(f"Invalidated cache for key: {key}")
    
    def clear(self) -> None:
        """Clear all cached data."""
        for cache_file in self.cache_dir.glob("*.pkl"):
            cache_file.unlink()
        self.logger.info("Cleared all cache")
    
    def get_cache_info(self) -> dict:
        """Get information about cached items."""
        info = {
            "total_items": 0,
            "total_size_mb": 0,
            "items": []
        }
        
        for cache_file in self.cache_dir.glob("*.pkl"):
            size_mb = cache_file.stat().st_size / (1024 * 1024)
            info["total_items"] += 1
            info["total_size_mb"] += size_mb
            
            try:
                with open(cache_file, "rb") as f:
                    cache_data = pickle.load(f)
                
                age = datetime.now() - cache_data["timestamp"]
                ttl_remaining = timedelta(hours=cache_data["ttl_hours"]) - age
                
                info["items"].append({
                    "key": cache_file.stem,
                    "size_mb": size_mb,
                    "age_hours": age.total_seconds() / 3600,
                    "ttl_remaining_hours": max(0, ttl_remaining.total_seconds() / 3600)
                })
            except:
                pass
        
        return info