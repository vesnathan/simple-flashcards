export interface PasswordValidation {
  message: string;
  satisfied: boolean;
}

export function validatePassword(password: string): PasswordValidation[] {
  return [
    {
      message: "Be at least 8 characters long",
      satisfied: password.length >= 8,
    },
    {
      message: "Contain at least one uppercase letter",
      satisfied: /[A-Z]/.test(password),
    },
    {
      message: "Contain at least one lowercase letter",
      satisfied: /[a-z]/.test(password),
    },
    {
      message: "Contain at least one number",
      satisfied: /[0-9]/.test(password),
    },
    {
      message: "Contain at least one special character (!@#$%^&*)",
      satisfied: /[!@#$%^&*]/.test(password),
    },
  ];
}

export function isPasswordValid(validations: PasswordValidation[]): boolean {
  return validations.every((v) => v.satisfied);
}
