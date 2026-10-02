export function validIdentifier(value: string) {
  if (!value) return true;
  if (!/^[\d.\-]+$/.test(value)) return /^[a-zA-Z0-9._-]{1,50}$/.test(value);
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const check = (n: number) => {
    const sum = Array.from({ length: n }, (_, i) => Number(digits[i]) * (n + 1 - i)).reduce(
      (a, b) => a + b,
      0,
    );
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function normalizeIdentifier(value: string) {
  return /^[\d.\-]+$/.test(value) ? value.replace(/\D/g, "") : value;
}
