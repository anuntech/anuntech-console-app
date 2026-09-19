import { Field } from "./ui";
import { payerAddress } from "@/lib/billing-rules";
import type { CompanyAddress } from "@/lib/company-billing";

export function CompanyBillingFields({
  address,
  autoIssueNfse = false,
}: {
  address?: CompanyAddress | null;
  autoIssueNfse?: boolean;
}) {
  return (
    <>
      <h2>Endereço de cobrança e nota fiscal</h2>
      <p className="muted">
        Salvo no cadastro para uso nas cobranças e notas fiscais. Você pode
        completar depois, antes de emitir uma cobrança.
      </p>
      <Field label="Endereço">
        <input
          name="endereco"
          maxLength={100}
          defaultValue={address?.endereco ?? ""}
          autoComplete="address-line1"
        />
      </Field>
      <div className="two-columns">
        <Field label="Número">
          <input
            name="numero"
            maxLength={10}
            defaultValue={address?.numero ?? ""}
          />
        </Field>
        <Field label="Complemento (opcional)">
          <input
            name="complemento"
            maxLength={30}
            defaultValue={address?.complemento ?? ""}
            autoComplete="address-line2"
          />
        </Field>
      </div>
      <Field label="Bairro">
        <input
          name="bairro"
          maxLength={60}
          defaultValue={address?.bairro ?? ""}
        />
      </Field>
      <div className="two-columns">
        <Field label="Cidade">
          <input
            name="cidade"
            maxLength={60}
            defaultValue={address?.cidade ?? ""}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="UF">
          <select
            name="uf"
            defaultValue={address?.uf ?? ""}
            autoComplete="address-level1"
          >
            <option value="">Selecione</option>
            {payerAddress.shape.uf.options.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="two-columns">
        <Field label="CEP">
          <input
            name="cep"
            inputMode="numeric"
            maxLength={9}
            defaultValue={address?.cep ?? ""}
            autoComplete="postal-code"
          />
        </Field>
        <Field label="Código IBGE do município (opcional)">
          <input
            name="codigoMunicipio"
            inputMode="numeric"
            maxLength={7}
            defaultValue={address?.codigoMunicipio ?? ""}
          />
        </Field>
      </div>
      <h2>Nota fiscal</h2>
      <label>
        <input
          type="checkbox"
          name="autoIssueNfse"
          value="yes"
          defaultChecked={autoIssueNfse}
        />{" "}
        Emitir nota fiscal automaticamente para este cliente
      </label>
      <p className="muted">
        Desmarcado: nenhuma emissão automática. A preferência fica salva; a
        emissão de NFS-e ainda depende da conclusão da integração fiscal e dos
        dados do serviço da Anuntech.
      </p>
    </>
  );
}
