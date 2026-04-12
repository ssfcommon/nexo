import { useEffect, useState } from 'react';

export default function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
