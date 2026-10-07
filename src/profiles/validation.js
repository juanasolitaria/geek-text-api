class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function invalid(message) { throw new HttpError(400, message); }

function objectBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Send a JSON object with Content-Type: application/json.');
  if (Object.keys(body).some((key) => !allowed.includes(key))) invalid('The request contains an unsupported field.');
}

function username(value) {
  if (typeof value !== 'string') invalid('username is required.');
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(normalized)) invalid('username must contain 3-32 letters, numbers, or underscores.');
  return normalized;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128 || !value.trim()) {
    invalid('password must contain 8-128 characters.');
  }
  return value;
}

function optionalText(value, field, limit) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length > limit) invalid(`${field} must be text of at most ${limit} characters, or null.`);
  return value.trim() || null;
}

function profileInput(body, updating = false) {
  const allowed = ['username', 'password', 'name', 'email', 'homeAddress'];
  objectBody(body, allowed);
  if (updating && Object.hasOwn(body, 'email')) invalid('email cannot be changed.');
  if (updating && Object.keys(body).length === 0) invalid('Provide at least one field to update.');
  const data = {};
  if (!updating || Object.hasOwn(body, 'username')) data.username = username(body.username);
  if (!updating || Object.hasOwn(body, 'password')) data.password = password(body.password);
  for (const [field, limit] of [['name', 100], ['homeAddress', 500], ['email', 254]]) {
    if (Object.hasOwn(body, field)) data[field] = optionalText(body[field], field, limit);
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) invalid('email must be a valid email address.');
  return data;
}

function cardLast4(body) {
  objectBody(body, ['cardNumber']);
  if (typeof body.cardNumber !== 'string' || body.cardNumber.length > 40 || !/^[0-9 -]+$/.test(body.cardNumber)) {
    invalid('cardNumber must be a string containing digits, spaces, or hyphens.');
  }
  const digits = body.cardNumber.replace(/[ -]/g, '');
  if (!/^\d{13,19}$/.test(digits) || /^(\d)\1+$/.test(digits)) invalid('cardNumber has an invalid length or format.');
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    double = !double;
  }
  if (sum % 10 !== 0) invalid('cardNumber failed the checksum validation.');
  return digits.slice(-4);
}

module.exports = { HttpError, profileInput, cardLast4, username };
