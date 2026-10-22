import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { FormSkeleton, LoadError, ManagerGate } from "@/components/manager-gate";
import { Section } from "@/components/section";
import { useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { formatCep, formatDocument, formatPhoneInput, onlyDigits, phoneDigits } from "@/lib/br-input";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { companyKey } from "@/lib/manager";
import { space, usePalette } from "@/lib/theme";

type Company = Awaited<ReturnType<typeof api.company.get>>;
type Address = NonNullable<Company["address"]>;
type Input = ComponentRef<typeof TextInput>;

const emptyAddress: Address = {
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  codigoMunicipio: "",
};

/** "Dados da empresa": the company's registration, as in Configurações > Empresa on the web. */
export default function CompanyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Dados da empresa" }} />
      <ManagerGate>
        <CompanyLoader />
      </ManagerGate>
    </>
  );
}

function CompanyLoader() {
  const palette = usePalette();
  const company = useQuery({ queryKey: companyKey, queryFn: () => api.company.get({}) });
  const loading = useDelayed(company.isPending);
  if (company.data) return <CompanyForm key={company.data.id} company={company.data} />;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block }}
    >
      {loading ? <FormSkeleton fields={6} /> : null}
      {company.error ? <LoadError error={company.error} onRetry={() => void company.refetch()} /> : null}
    </ScrollView>
  );
}

function CompanyForm({ company }: { company: Company }) {
  const palette = usePalette();
  const queryClient = useQueryClient();
  const bottom = useTabBarSpace();
  const [name, setName] = useState(company.name);
  const [document, setDocument] = useState(onlyDigits(company.document));
  const [billingEmail, setBillingEmail] = useState(company.billingEmail);
  const [phone, setPhone] = useState(phoneDigits(company.phone));
  const [address, setAddress] = useState<Address>(() => ({
    ...emptyAddress,
    ...company.address,
    cep: onlyDigits(company.address?.cep ?? ""),
  }));
  const documentRef = useRef<Input>(null);
  const emailRef = useRef<Input>(null);
  const phoneRef = useRef<Input>(null);
  const cepRef = useRef<Input>(null);
  const streetRef = useRef<Input>(null);
  const numberRef = useRef<Input>(null);
  const complementRef = useRef<Input>(null);
  const districtRef = useRef<Input>(null);
  const cityRef = useRef<Input>(null);
  const ufRef = useRef<Input>(null);

  const save = useMutation({
    mutationFn: () => {
      // All or nothing, as on the web: every field empty means no address; anything
      // else goes as is and the server says what is missing.
      const filled = Object.values(address).some((value) => value.trim());
      return api.company.update({
        name: name.trim(),
        document,
        billingEmail: billingEmail.trim().toLowerCase(),
        phone,
        address: filled
          ? {
              cep: address.cep,
              endereco: address.endereco.trim(),
              numero: address.numero.trim(),
              complemento: address.complemento.trim(),
              bairro: address.bairro.trim(),
              cidade: address.cidade.trim(),
              uf: address.uf.trim().toUpperCase(),
              codigoMunicipio: address.codigoMunicipio,
            }
          : null,
      });
    },
    onSuccess: async () => {
      haptic.success();
      // The web revalidates every page after this; the company's name shows across the app.
      await queryClient.invalidateQueries();
    },
    onError: () => haptic.error(),
  });
  const lookup = useMutation({
    mutationFn: () => api.company.lookupCep({ cep: address.cep }),
    onSuccess: (found) => {
      haptic.success();
      setAddress((current) => ({ ...current, ...found }));
      numberRef.current?.focus();
    },
    onError: () => haptic.error(),
  });

  /** Any edit clears the last answer, so an old "atualizados" never sits under new changes. */
  const touched = () => {
    if (save.isSuccess || save.isError) save.reset();
  };
  const setField = (key: keyof Address, value: string) => {
    touched();
    setAddress((current) => ({
      ...current,
      [key]: value,
      // A city typed by hand no longer matches the IBGE code the CEP brought.
      ...(key === "cidade" || key === "uf" ? { codigoMunicipio: "" } : {}),
    }));
  };
  const canLookup = address.cep.length === 8 && !lookup.isPending;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
      >
        <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.xs }}>
          Razão social, contato financeiro e endereço usados nas cobranças.
        </Text>

        <Section header="Identificação">
          <View style={{ padding: space.lg, gap: space.form }}>
            <Field
              label="Razão social"
              testID="company-name"
              value={name}
              onChangeText={(text) => {
                touched();
                setName(text);
              }}
              maxLength={160}
              autoComplete="organization"
              textContentType="organizationName"
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => documentRef.current?.focus()}
            />
            <Field
              ref={documentRef}
              label="CPF ou CNPJ"
              testID="company-document"
              value={formatDocument(document)}
              onChangeText={(text) => {
                touched();
                setDocument(onlyDigits(text).slice(0, 14));
              }}
              keyboardType="number-pad"
              maxLength={18}
              autoComplete="off"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>
        </Section>

        <Section header="Contato financeiro">
          <View style={{ padding: space.lg, gap: space.form }}>
            <Field
              ref={emailRef}
              label="E-mail de cobrança"
              testID="company-email"
              value={billingEmail}
              onChangeText={(text) => {
                touched();
                setBillingEmail(text.trim().toLowerCase());
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={254}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            <Field
              ref={phoneRef}
              label="Telefone"
              testID="company-phone"
              placeholder="(11) 99999-9999"
              value={formatPhoneInput(phone)}
              onChangeText={(text) => {
                touched();
                setPhone(phoneDigits(text).slice(0, 11));
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={16}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => cepRef.current?.focus()}
            />
          </View>
        </Section>

        <Section
          header="Endereço de cobrança e nota fiscal"
          footer="Preencha o endereço inteiro ou deixe tudo em branco."
        >
          <View style={{ padding: space.lg, gap: space.form }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  ref={cepRef}
                  label="CEP"
                  testID="company-cep"
                  placeholder="00000-000"
                  value={formatCep(address.cep)}
                  onChangeText={(text) => {
                    setField("cep", onlyDigits(text).slice(0, 8));
                    if (lookup.isError) lookup.reset();
                  }}
                  keyboardType="number-pad"
                  autoComplete="postal-code"
                  textContentType="postalCode"
                  maxLength={9}
                  returnKeyType="search"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={() => canLookup && lookup.mutate()}
                />
              </View>
              <View style={{ paddingBottom: 3 }}>
                <Button
                  title={lookup.isPending ? "Buscando…" : "Buscar"}
                  icon="magnifyingglass"
                  variant="secondary"
                  testID="lookup-cep"
                  accessibilityHint="Preenche endereço, bairro, cidade e UF pelo CEP"
                  busy={lookup.isPending}
                  disabled={address.cep.length !== 8}
                  onPress={() => lookup.mutate()}
                />
              </View>
            </View>
            {lookup.error ? <Notice kind="error">{errorMessage(lookup.error)}</Notice> : null}
            <Field
              ref={streetRef}
              label="Endereço"
              testID="company-street"
              placeholder="Rua, avenida…"
              value={address.endereco}
              onChangeText={(text) => setField("endereco", text)}
              maxLength={100}
              autoComplete="address-line1"
              textContentType="streetAddressLine1"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => numberRef.current?.focus()}
            />
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ flex: 2 }}>
                <Field
                  ref={numberRef}
                  label="Número"
                  testID="company-number"
                  value={address.numero}
                  onChangeText={(text) => setField("numero", text)}
                  maxLength={10}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => complementRef.current?.focus()}
                />
              </View>
              <View style={{ flex: 3 }}>
                <Field
                  ref={complementRef}
                  label="Complemento"
                  testID="company-complement"
                  value={address.complemento}
                  onChangeText={(text) => setField("complemento", text)}
                  maxLength={30}
                  autoComplete="address-line2"
                  textContentType="streetAddressLine2"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => districtRef.current?.focus()}
                />
              </View>
            </View>
            <Field
              ref={districtRef}
              label="Bairro"
              testID="company-district"
              value={address.bairro}
              onChangeText={(text) => setField("bairro", text)}
              maxLength={60}
              textContentType="sublocality"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => cityRef.current?.focus()}
            />
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ flex: 3 }}>
                <Field
                  ref={cityRef}
                  label="Cidade"
                  testID="company-city"
                  value={address.cidade}
                  onChangeText={(text) => setField("cidade", text)}
                  maxLength={60}
                  textContentType="addressCity"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => ufRef.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  ref={ufRef}
                  label="UF"
                  testID="company-uf"
                  placeholder="SP"
                  value={address.uf}
                  onChangeText={(text) => setField("uf", text.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2))}
                  maxLength={2}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  textContentType="addressState"
                  returnKeyType="done"
                />
              </View>
            </View>
            {address.codigoMunicipio ? (
              <Text variant="caption" tone="muted">
                Código IBGE {address.codigoMunicipio}
              </Text>
            ) : null}
          </View>
        </Section>

        <View style={{ gap: space.md }}>
          {save.data ? <Notice kind="success">{save.data.message}</Notice> : null}
          {save.error ? <Notice kind="error">{errorMessage(save.error)}</Notice> : null}
          <Button
            title={save.isPending ? "Salvando…" : "Salvar"}
            testID="save-company"
            busy={save.isPending}
            onPress={() => save.mutate()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
