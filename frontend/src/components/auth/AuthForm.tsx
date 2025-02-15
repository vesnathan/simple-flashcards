import { useState, useMemo } from "react";
import { Button } from "@heroui/button";

import { useAuthStore } from "@/stores/authStore";
import PasswordHelper from "@/components/PasswordHelper";
import { validatePassword, isPasswordValid } from "@/utils/passwordValidation";

export function AuthForm() {
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
      isPasswordValid(passwordValidations) &&
      password === passwordConfirm &&
      email.includes("@"),
    [passwordValidations, password, passwordConfirm, email],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setIsLogin(true); // Switch to login after registration
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="sr-only" htmlFor="email">
                Email address
              </label>
              <input
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                id="email"
                name="email"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="password">
                Password
              </label>
              <input
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                id="password"
                name="password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="sr-only" htmlFor="passwordConfirm">
                    Confirm Password
                  </label>
                  <input
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    id="passwordConfirm"
                    name="passwordConfirm"
                    placeholder="Confirm Password"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                  />
                </div>
                <PasswordHelper validateResult={passwordValidations} />
              </>
            )}
          </div>

          <div>
            <Button
              className="w-full bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isLogin && !isValid}
              type="submit"
            >
              {isLogin ? "Sign in" : "Register"}
            </Button>
          </div>
        </form>
        <div className="text-center">
          <button
            className="text-sm text-primary-600 hover:text-primary-800"
            type="button"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin
              ? "Don't have an account? Register"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
