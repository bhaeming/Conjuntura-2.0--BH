import { redirect } from "next/navigation";

// Os temas agora são seções da página contínua de Conjuntura.
export default function Page() {
  redirect("/#precos");
}
