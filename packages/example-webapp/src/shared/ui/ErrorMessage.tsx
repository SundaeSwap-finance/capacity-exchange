import { Message } from './Message';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <Message variant="error">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-blue-400 hover:text-blue-300 mt-2">
          Retry
        </button>
      )}
    </Message>
  );
}
