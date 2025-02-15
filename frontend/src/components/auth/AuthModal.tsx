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

              <div>
                <label
                  className="block text-sm font-medium text-neutral-700"
                  htmlFor="password"
                >
                  Password
                </label>
                <input
                  required
                  className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md"
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label
                      className="block text-sm font-medium text-neutral-700"
                      htmlFor="passwordConfirm"
                    >
                      Confirm Password
                    </label>
                    <input
                      required
                      className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded-md"
                      id="passwordConfirm"
                      name="passwordConfirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                    />
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
