"""In-memory storage for visual context to share with realtime conversations."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from threading import Lock

from app.services.vision import VisionContext


class ContextStorage:
    """Thread-safe in-memory storage for visual context."""
    
    def __init__(self, ttl_minutes: int = 30) -> None:
        self._storage: Dict[str, VisionContext] = {}
        self._lock = Lock()
        self._ttl = timedelta(minutes=ttl_minutes)
    
    def store_context(self, session_id: str, context: VisionContext) -> None:
        """Store visual context for a session."""
        with self._lock:
            self._storage[session_id] = context

    def get_context(self, session_id: str) -> Optional[VisionContext]:
        """Retrieve visual context for a session."""
        with self._lock:
            context = self._storage.get(session_id)
            if context is None:
                return None
            
            # Check if context is expired
            if datetime.now(timezone.utc) - context.timestamp > self._ttl:
                del self._storage[session_id]
                return None
            
            return context

    def get_latest_context(self) -> Optional[VisionContext]:
        """Return the most recent, non-expired context across all sessions."""

        now = datetime.now(timezone.utc)
        with self._lock:
            latest_context: Optional[VisionContext] = None
            expired_sessions: list[str] = []

            for session_id, context in self._storage.items():
                if now - context.timestamp > self._ttl:
                    expired_sessions.append(session_id)
                    continue

                if latest_context is None or context.timestamp > latest_context.timestamp:
                    latest_context = context

            for session_id in expired_sessions:
                del self._storage[session_id]

        return latest_context
    
    def clear_context(self, session_id: str) -> None:
        """Clear visual context for a session."""
        with self._lock:
            self._storage.pop(session_id, None)
    
    def clear_expired(self) -> None:
        """Clear all expired contexts."""
        now = datetime.now(timezone.utc)
        with self._lock:
            expired_keys = [
                session_id for session_id, context in self._storage.items()
                if now - context.timestamp > self._ttl
            ]
            for session_id in expired_keys:
                del self._storage[session_id]


# Global instance
_context_storage = ContextStorage()


def get_context_storage() -> ContextStorage:
    """Get the global context storage instance."""
    return _context_storage
