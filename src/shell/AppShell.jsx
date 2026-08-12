export default function AppShell({ children, className = "", header }) {
  return (
    <div className={`page${className ? ` ${className}` : ""}`}>
      {header}
      {children}
    </div>
  );
}
