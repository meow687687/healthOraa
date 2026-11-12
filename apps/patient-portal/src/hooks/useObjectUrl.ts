import { useEffect, useState } from "react";

// Object URL for a file, released when the file changes or the component unmounts.
export const useObjectUrl = (file: File | null): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return url;
};
