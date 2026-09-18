// The wordmark, as the design sets it: the one place the brand colour is used.
import type { ReactElement } from 'react';

import styles from '~/components/Wordmark.module.scss';

export const Wordmark = (): ReactElement => <span className={styles.wordmark}>{`Guardio`}</span>;
