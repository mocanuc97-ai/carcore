export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white">CarCore</h1>
          <p className="text-zinc-400 mt-2">Management service auto</p>
        </div>
        {children}
      </div>
    </div>
  );
}
