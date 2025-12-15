export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="login-shell">
      <main className="login-main">{children}</main>
    </div>
  );
}
