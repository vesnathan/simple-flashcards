import { useState, useMemo } from "react";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

import { useAuthStore } from "@/stores/authStore";
import PasswordHelper from "@/components/PasswordHelper";
import { validatePassword, isPasswordValid } from "@/utils/passwordValidation";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const { signIn, signUp } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValidations = useMemo(
    () => validatePassword(password),
    [password],
  );
  const isValid = useMemo(
    () =>
      isLogin ||
      (isPasswordValid(passwordValidations) &&
        password === passwordConfirm &&
        email.includes("@")),
    [isLogin, passwordValidations, password, passwordConfirm, email],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        await signIn(email, password);
        onClose();
      } else {
        await signUp(email, password);
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader className="border-b border-neutral-200 p-4">
            <h2 className="text-xl font-semibold">
              {isLogin ? "Sign in to your account" : "Create a new account"}
            </h2>
          </ModalHeader>

          <ModalBody className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium text-neutral-700"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  required
                  className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md"
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="relative">
                <label
                  className="block text-sm font-medium text-neutral-700"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md pr-10"
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                        <path
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <>
                  <div className="relative">
                    <label
                      className="block text-sm font-medium text-neutral-700"
                      htmlFor="passwordConfirm"
                    >
                      Confirm Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        required
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md pr-10"
                        id="passwordConfirm"
                        name="passwordConfirm"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                      />
                      <button
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                            />
                            <path
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <PasswordHelper validateResult={passwordValidations} />
                </>
              )}
            </div>

            <button
              className="text-sm text-primary-600 hover:text-primary-800"
              type="button"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin
                ? "Don't have an account? Register"
                : "Already have an account? Sign in"}
            </button>
          </ModalBody>

          <ModalFooter className="border-t border-neutral-200 p-4">
            <div className="flex justify-end gap-3">
              <Button variant="bordered" onPress={onClose}>
                Cancel
              </Button>
              <Button
                className="bg-primary-600 hover:bg-primary-700 text-white"
                disabled={!isValid}
                type="submit"
              >
                {isLogin ? "Sign in" : "Register"}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
