interface CharacterCounterProps {
  current: number;
  max: number;
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  return (
    <div className="mt-1 text-xs text-dark-500">
      {current}/{max} characters
    </div>
  );
}
