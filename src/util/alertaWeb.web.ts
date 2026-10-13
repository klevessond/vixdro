// src/util/alertaWeb.web.ts  (navegador)
//
// No navegador, o Alert.alert do React Native não faz NADA: erros ficariam
// invisíveis e confirmações ("Excluir projeto?", "Enviar pedido?") nunca
// executariam a ação. Aqui ele passa a usar as caixas do próprio navegador,
// e todas as telas funcionam sem alteração.
//
// Importado uma única vez, no src/app/_layout.tsx.

import { Alert, AlertButton } from "react-native";

Alert.alert = (titulo: string, mensagem?: string, botoes?: AlertButton[]) => {
  const texto = [titulo, mensagem].filter(Boolean).join("\n\n");

  // Só um botão (ou nenhum): é um aviso.
  if (!botoes || botoes.length <= 1) {
    window.alert(texto);
    botoes?.[0]?.onPress?.();
    return;
  }

  // Dois ou mais: é uma confirmação. "OK" executa a ação principal (o último
  // botão que não é de cancelar); "Cancelar" executa o botão de cancelar.
  const cancelar = botoes.find((b) => b.style === "cancel");
  const confirmar = [...botoes].reverse().find((b) => b.style !== "cancel");
  if (window.confirm(texto)) confirmar?.onPress?.();
  else cancelar?.onPress?.();
};
