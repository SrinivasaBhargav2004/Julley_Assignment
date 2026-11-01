import { useState, useCallback, useEffect } from 'react';

export function useUndoRedo() {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const pushAction = useCallback((action) => {
    // action: { type, description, undo: async () => {}, redo: async () => {} }
    setUndoStack((prev) => [...prev.slice(-20), action]); // keep last 20 actions
    setRedoStack([]); // clear redo stack on new action
  }, []);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));

    try {
      if (action.undo) {
        await action.undo();
      }
      setRedoStack((prev) => [...prev, action]);
    } catch (err) {
      console.error('Failed to undo action:', err);
    }
  }, [undoStack]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));

    try {
      if (action.redo) {
        await action.redo();
      }
      setUndoStack((prev) => [...prev, action]);
    } catch (err) {
      console.error('Failed to redo action:', err);
    }
  }, [redoStack]);

  // Global Keyboard shortcuts: Ctrl+Z / Cmd+Z and Ctrl+Y / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoActionName: undoStack[undoStack.length - 1]?.description || null,
    redoActionName: redoStack[redoStack.length - 1]?.description || null,
    pushAction,
    undo,
    redo,
  };
}
