import styles from "@/components/public-layout.module.css";
export default function Loading() {
  return (
    <div
      className={styles.skeletonPage}
      role="status"
      aria-label="Carregando o Console"
    >
      <span className={styles.visuallyHidden}>Carregando o Console…</span>
      <div className={styles.skeletonHeading} aria-hidden="true">
        <span className={styles.skeleton} />
        <span className={styles.skeleton} />
        <span className={styles.skeleton} />
      </div>
      <div className={styles.skeletonGrid} aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div key={item}>
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
          </div>
        ))}
      </div>
      <div className={styles.skeletonTable} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((item) => (
          <div className={styles.skeletonRow} key={item}>
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
          </div>
        ))}
      </div>
    </div>
  );
}
