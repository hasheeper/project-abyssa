import { useCallback, useState } from "react";

interface ControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  value,
  defaultValue,
  onChange
}: ControllableStateOptions<T>) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const state = isControlled ? value : internalValue;

  const setState = useCallback(
    (nextValue: T) => {
      if (!isControlled) setInternalValue(nextValue);
      onChange?.(nextValue);
    },
    [isControlled, onChange]
  );

  return [state, setState] as const;
}
