import Image from "next/image";
export function Brand() {
  return (
    <div className="brand">
      <Image src="/brand/symbol.png" alt="" width={40} height={40} />
      <div>
        <span>Anuntech</span>
        <strong>Console</strong>
      </div>
    </div>
  );
}
