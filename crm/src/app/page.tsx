import { redirect } from "next/navigation";

/** La raiz redirige al dashboard (DEFAULT_LOGIN_REDIRECT, Task 5). */
export default function Home() {
  redirect("/dashboard");
}
