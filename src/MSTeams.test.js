// src/MSTeams.test.js
const MSTeams = require('./MSTeams');
const { IncomingWebhook } = require('ms-teams-webhook');

// Mock the github context
jest.mock('@actions/github', () => ({
  context: {
  payload: {
    repository: {
      html_url: 'html_url',
      name: 'name'
    },
    compare: 'compare_url',
    sender: {
      login: 'login',
      url: 'url'
    },
    commits: [],
    head_commit: {
      timestamp: 'timestamp'
    }
  },
  eventName: 'push',
  workflow: 'test_workflow'
}
}));

jest.mock('ms-teams-webhook');

describe('MSTeams.notify', () => {
  const webhookUrl = 'test-webhook-url';
  const payload = { message: 'Test Payload' };

  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Mock the IncomingWebhook class and its send method
    mockSend = jest.fn();
    IncomingWebhook.mockImplementation(() => ({
      sendRawAdaptiveCard: mockSend,
    }));
  });

  it('should send a success notification', async () => {
    mockSend.mockResolvedValueOnce({ status: 202 });

    const msTeams = new MSTeams();
    await msTeams.notify(webhookUrl, payload);

    expect(IncomingWebhook).toHaveBeenCalledWith(webhookUrl);
    expect(mockSend).toHaveBeenCalledWith(payload);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if the notification fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('Webhook error'));

    const msTeams = new MSTeams();
    await expect(msTeams.notify(webhookUrl, payload)).rejects.toThrow(expect.any(Error));

    expect(IncomingWebhook).toHaveBeenCalledWith(webhookUrl);
    expect(mockSend).toHaveBeenCalledWith(payload);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should throw an error for missing webhookUrl', async () => {
    const msTeams = new MSTeams();
    await expect(msTeams.notify(undefined, payload)).rejects.toThrow(expect.any(Error));

    expect(IncomingWebhook).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should throw an error for missing payload', async () => {
    const msTeams = new MSTeams();
    await expect(msTeams.notify(webhookUrl, undefined)).rejects.toThrow(expect.any(Error));

    expect(IncomingWebhook).not.toHaveBeenCalled();
    expect(IncomingWebhook.prototype.send).not.toHaveBeenCalled();
  });

  it('Returns error for empty response', async () => {
    mockSend.mockResolvedValueOnce({});

    const msTeams = new MSTeams();
    await expect(msTeams.notify(webhookUrl, payload)).rejects.toThrow(expect.any(Error));

    expect(IncomingWebhook).toHaveBeenCalledWith(webhookUrl);
    expect(mockSend).toHaveBeenCalledWith(payload);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('Handles response with circular references without JSON.stringify errors', async () => {
    // Create a mock response object with circular references similar to HTTP ClientRequest/TLSSocket
    const mockResponseWithCircularRef = {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
      data: { error: 'Invalid payload' }
    };

    // Create circular reference to simulate ClientRequest -> TLSSocket -> _httpMessage -> ClientRequest
    const socket = { _httpMessage: mockResponseWithCircularRef };
    mockResponseWithCircularRef.socket = socket;

    // This creates the circular reference that would cause JSON.stringify to fail
    mockSend.mockResolvedValueOnce(mockResponseWithCircularRef);

    const msTeams = new MSTeams();
    
    // This should throw an error but NOT a circular reference error
    try {
      await msTeams.notify(webhookUrl, payload);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Verify the error message contains the safe response data and not circular reference errors
      expect(error.message).toContain('Failed to send notification to Microsoft Teams');
      expect(error.message).toContain('"status": 400');
      expect(error.message).toContain('"statusText": "Bad Request"');
      expect(error.message).not.toContain('Converting circular structure to JSON');
      
      // Verify that the error message includes the response details we expect
      const errorMessage = error.message;
      expect(errorMessage).toMatch(/"status":\s*400/);
      expect(errorMessage).toMatch(/"statusText":\s*"Bad Request"/);
    }

    expect(IncomingWebhook).toHaveBeenCalledWith(webhookUrl);
    expect(mockSend).toHaveBeenCalledWith(payload);
  });
});