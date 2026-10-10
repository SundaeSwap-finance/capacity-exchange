interface CharacterCounterProps {
  current: number;
  max: number;
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  return (
    <div className="mt-1 text-xs">
      {current}/{max} characters
    </div>
  );
}
