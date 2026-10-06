"use client";

import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import type { FlowSnapshot } from "@/components/automation-builder/flow-model";

// Undo/redo for the builder canvas. Pure reducer so the stack rules can be
// reasoned about (and tested) without a DOM. Typing into one config field
// coalesces into a single undo step; drags record one checkpoint, and only
// when the node actually moved.

const HISTORY_LIMIT = 100;
const COALESCE_WINDOW_MS = 1000;

export type HistoryState = {
  past: FlowSnapshot[];
  present: FlowSnapshot;
  future: FlowSnapshot[];
  lastKey: string | null;
  lastAt: number;
};

export type HistoryAction =
  | { type: "set"; update: FlowSnapshot | ((s: FlowSnapshot) => FlowSnapshot); record: boolean; key?: string; at: number }
  | { type: "checkpoint"; snapshot: FlowSnapshot }
  | { type: "undo" }
  | { type: "redo" };

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "set": {
      const next = typeof action.update === "function" ? action.update(state.present) : action.update;
      if (!action.record) return { ...state, present: next };
      const coalesce =
        action.key !== undefined && action.key === state.lastKey && action.at - state.lastAt < COALESCE_WINDOW_MS;
      if (coalesce) return { ...state, present: next, lastAt: action.at };
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        lastKey: action.key ?? null,
        lastAt: action.at,
      };
    }
    case "checkpoint":
      return {
        ...state,
        past: [...state.past, action.snapshot].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: null,
      };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
        lastKey: null,
        lastAt: 0,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
        lastKey: null,
        lastAt: 0,
      };
    }
  }
}

export function useFlowHistory(initial: FlowSnapshot) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
    lastKey: null,
    lastAt: 0,
  });
  // Latest present state for event handlers that run outside render.
  const presentRef = useRef(state.present);
  useLayoutEffect(() => {
    presentRef.current = state.present;
  });

  const update = useCallback(
    (u: FlowSnapshot | ((s: FlowSnapshot) => FlowSnapshot), opts: { record: boolean; key?: string }) =>
      dispatch({ type: "set", update: u, record: opts.record, key: opts.key, at: Date.now() }),
    []
  );
  const checkpoint = useCallback((snapshot: FlowSnapshot) => dispatch({ type: "checkpoint", snapshot }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  return {
    present: state.present,
    presentRef,
    update,
    checkpoint,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
