const TrafficData = require('../../src/models/TrafficData');

describe('TrafficData statics', () => {
  test('getRecent builds query with and without intersectionId', () => {
    const q1 = TrafficData.getRecent(null, 5);
    expect(q1).toBeTruthy();
    const q2 = TrafficData.getRecent('I', 5);
    expect(q2).toBeTruthy();
  });

  test('getAggregatedData builds pipeline for each groupBy', async () => {
    const pMinute = TrafficData.getAggregatedData(null, new Date(), new Date(), 'minute');
    expect(pMinute).toBeTruthy();
    const pHour = TrafficData.getAggregatedData(null, new Date(), new Date(), 'hour');
    expect(pHour).toBeTruthy();
    const pDay = TrafficData.getAggregatedData(null, new Date(), new Date(), 'day');
    expect(pDay).toBeTruthy();
    const pDefault = TrafficData.getAggregatedData(null, new Date(), new Date(), 'unknown');
    expect(pDefault).toBeTruthy();
  });
});