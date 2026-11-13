interface UseDesktopSignInOptions {
  apiBase?: string;
  onSuccess?: () => void;
}

export function useDesktopSignIn(options: UseDesktopSignInOptions = {}) {
  void options;
  return {
    signIn: async () => {
      throw new Error("Athas accounts are not supported.");
    },
    isSigningIn: false,
    error: null,
    cancel: () => {},
    reopen: async () => {},
  };
}
