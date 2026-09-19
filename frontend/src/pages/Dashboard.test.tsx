import { beforeEach, describe, it } from 'vitest';

import { anExperimentResultDTO } from '~/testkit/builders';
import { Recommendation } from '~/models/experimentResult';
import { BannerClass } from '~/components/RecommendationBanner.utils';
import { type DashboardDriver, makeDashboardDriver } from '~/pages/Dashboard.driver';

const STATEMENT = 'An urgent framing of the result screen raises the activation rate';
const REQUIRED_PER_ARM = 4921;

describe('Dashboard page', () => {
    let driver: DashboardDriver;

    beforeEach(() => {
        driver = makeDashboardDriver();
    });

    it('renders the hypothesis, one funnel series per arm, the lift with its interval and the call', async () => {
        driver.given.theServerAnswers(anExperimentResultDTO().build());
        await driver.when.created();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.funnelLegendLists('calm', 'urgent');
        driver.assert.barReads({ series: 'calm', step: 'landing_view', share: 1, value: 1250 });
        driver.assert.barReads({ series: 'calm', step: 'activation', share: 80 / 1250, value: 80 });
        driver.assert.barReads({ series: 'urgent', step: 'activation', share: 100 / 1240, value: 100 });
        driver.assert.liftReads('+25.0%');
        driver.assert.intervalReads('95% CI −5.6% to +65.5% · p = 0.118');
        driver.assert.bannerReads(
            `Keep running — 1,000 of ${REQUIRED_PER_ARM.toLocaleString('en-US')} required per arm`,
        );
    });

    it('shows how far the smaller arm has got towards the required sample while under-powered', async () => {
        driver.given.theServerAnswers(anExperimentResultDTO().build());
        await driver.when.created();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.bannerIsClassed(BannerClass.Wait);
        driver.assert.sampleProgressReads({ reached: 1000, required: REQUIRED_PER_ARM });
    });

    it('says the arms do not differ yet once the sample is reached without a significant result', async () => {
        driver.given.theServerAnswers(
            anExperimentResultDTO().withSample({ requiredPerArm: REQUIRED_PER_ARM, reachedPerArm: 5000 }).build(),
        );
        await driver.when.created();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.bannerReads('Keep running — no significant difference yet');
        driver.assert.noSampleProgressIsShown();
    });

    it('calls the variant shipped on a significant win with enough traffic', async () => {
        driver.given.theServerAnswers(
            anExperimentResultDTO()
                .withRecommendation(Recommendation.ShipVariant)
                .withPValue(0.004)
                .withSample({ requiredPerArm: REQUIRED_PER_ARM, reachedPerArm: 5000 })
                .build(),
        );
        await driver.when.created();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.bannerReads('Ship variant — urgent outperforms calm with high confidence');
        driver.assert.bannerIsClassed(BannerClass.Ship);
        driver.assert.intervalReads('p = 0.004');
    });

    it('calls the control kept on a significant loss', async () => {
        driver.given.theServerAnswers(anExperimentResultDTO().withRecommendation(Recommendation.KeepControl).build());
        await driver.when.created();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.bannerReads('Keep control — urgent underperforms calm with high confidence');
        driver.assert.bannerIsClassed(BannerClass.Stop);
    });

    it('reads calmly before anyone has been through: zero bars, no lift, and the sample at zero', async () => {
        driver.given.theServerAnswers(anExperimentResultDTO().beforeAnyVisitor().build());
        await driver.when.created();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.barReads({ series: 'calm', step: 'landing_view', share: 0, value: 0 });
        driver.assert.liftReads('—');
        driver.assert.intervalReads('Not enough data yet');
        driver.assert.sampleProgressReads({ reached: 0, required: REQUIRED_PER_ARM });
    });

    it('shows an error state in its own words, logs the server’s, and recovers on retry', async () => {
        driver.given.theServerFails();
        await driver.when.created();
        await driver.assert.loadErrorIsShown();
        driver.assert.loadFailureWasLogged();
        driver.given.theServerAnswers(anExperimentResultDTO().build());
        await driver.click.retry();
        await driver.assert.hypothesisReads(STATEMENT);
    });

    it('survives a StrictMode double-mount with one rendered result and the first fetch aborted', async () => {
        driver.given.theServerAnswers(anExperimentResultDTO().build());
        await driver.when.createdInStrictMode();
        await driver.assert.hypothesisReads(STATEMENT);
        driver.assert.exactlyOneFunnelIsRendered();
        driver.assert.resultsWereRequested(2);
        driver.assert.theFirstRequestWasAborted();
        driver.assert.noLoadFailureWasLogged();
    });

    it('aborts the fetch in flight when the page is left before the answer arrives', async () => {
        driver.given.theAnswerNeverArrives();
        await driver.when.created();
        await driver.when.unmounted();
        driver.assert.theRequestInFlightWasAborted();
    });
});
