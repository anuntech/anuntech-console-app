import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>Página não encontrada.</h1>
      <p>O endereço não está disponível para o seu acesso.</p>
      <Link href="/painel" className="button primary">
        Voltar à Console
      </Link>
    </main>
  );
}
