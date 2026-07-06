// Marca de la app (signature visual): el cartel colgante de "pub". El logo ya
// incluye el nombre, asi que hace de mark + wordmark a la vez.
export default function Brand() {
  return (
    <div className="brand">
      <img className="brand-logo" src="/pub-logo.png" width="449" height="512" alt="pub" />
    </div>
  );
}
