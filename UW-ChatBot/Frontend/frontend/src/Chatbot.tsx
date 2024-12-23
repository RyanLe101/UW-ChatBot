import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';
import logo from './photos/uwchatbotlogo.png';
import axios from 'axios';
import Modal from './Modal';
import payment from './payment.png';

type QualityData = {
  accuracy: string | null;
  completeness: string | null;
  speed: string | null;
  errorHandling: string | null;
};

type Message = {
  sender: "bot" | "user";
  text: string | JSX.Element;
};

const Chatbot = () => {
  // state variables to set the states of the chatbot

  // chatbot conversations
  const [question, setQuestion] = useState(''); // user input for questions
  const [conversation, setConversation] = useState<Message[]>([]); // store the conversations
  const [loading, setLoading] = useState(false); // track the loading state

  // hardcoded
  const [hardcodedStep, setHardcodedStep] = useState(0); 
  const [credits, setCredits] = useState(0); 
  const [isResident, setIsResident] = useState(false);

  // aws
  const [inputText, setInputText] = useState('');
  const [responseText, setResponseText] = useState('');

  // suggestion questions
  const [suggestions] = useState([
    "What are the tuition fees?",
    "How many credits do I need?",
    "What is the GPA requirement?",
    "Tell me about UW campus life.",
  ]);

  // quality metrics for users
  const [qualityData, setQualityData] = useState<QualityData>({
    accuracy: '80%',
    completeness: '100%',
    speed: '2.868s',
    errorHandling: '60%',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonateOpen, setDonateOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  // selecting different models for dropdown
  const [selectedModel, setSelectedModel] = useState<'ChatGPT' | 'Hardcoded' | 'AWS'>('AWS');

  // flag for ending the conversation
  const [isEndClicked, setIsEndClicked] = useState(false);

  // beginning of the conversation
  useEffect(() => {
    setConversation([{ sender: 'bot', text: 'Woof woof! 🐾 I know all about UW' }]);
  }, []);

  // autoscroll down to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // handle the feedback submit
  const handleFeedbackSubmit = () => {
    setConversation((prev) => [
      ...prev,
      {
        sender: 'bot',
        text: (
          <>
            <a href="https://forms.gle/9YrmNPymBuae973P8" target="_blank" rel="noopener noreferrer">
              Please rate your experience! 
            </a> {' '}
            We would love to hear your feedback! ❤️
          </>
        ),
      },
    ]);
    handleEndButton();
  };

  // handle the questions entered by the user
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() === '' || loading) return;
  
    const userMessage: Message = { sender: 'user', text: question };
    setConversation((prev) => [...prev, userMessage]);
    setLoading(true);
  
    if (selectedModel === 'ChatGPT') {
      await fetchChatGPTResponse(question);
    } else if (selectedModel === 'Hardcoded') {
      await handleHardcodedResponse(question);
    } else if (selectedModel === 'AWS') {
      await fetchAWSResponse(question);
    }
  
    setQuestion('');
  };

  // handle the end button and its state
  const handleEndButton = () => {
    setIsEndClicked(true);
  };
  
  // fetch the response from the AWS
  const fetchAWSResponse = async (question: string) => {
    console.log('fetchAWSResponse called with question:', question); // Debug log
    setConversation((prev) => [...prev, { sender: 'bot', text: '...' }]);

    try {
      const res = await axios.post('http://localhost:5000/generate-response', { inputText: question }, {
        withCredentials: true, // Include credentials if using sessions
      });
      console.log('Received response:', res.data.response); // Debug log

      if (res.data.response) {
        setConversation((prev) => [...prev.slice(0,-1), { sender: 'bot', text: res.data.response }]);
        console.log('Bot response added to conversation.');
      } else {
        console.warn('No response field in the backend response.');
        setConversation((prev) => [
          ...prev,
          { sender: 'bot', text: 'Sorry, I could not fetch the response at this time.' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching response:', error);
      setConversation((prev) => [
        ...prev,
        { sender: 'bot', text: 'Sorry, I could not fetch the response at this time.' },
      ]);
    } finally {
      console.log('fetchAWSResponse completed. Setting loading to false.');
      setLoading(false);
    }
  };
  
  // fetch the response from the ChatGPT
  const fetchChatGPTResponse = async (question: string) => {
    let botMessage = '';
    setConversation((prev) => [...prev, { sender: 'bot', text: '...' }]);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: question }],
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const messages = chunk.split('\n').filter((line) => line.trim() !== '');

          messages.forEach((msg) => {
            if (msg.startsWith('data: ')) {
              const data = msg.replace('data: ', '');
              try {
                const json = JSON.parse(data);
                if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                  botMessage += json.choices[0].delta.content;
                  setConversation((prev) => [
                    ...prev.slice(0, -1),
                    { sender: 'bot', text: botMessage },
                  ]);
                }
              } catch (error) {
                console.error('Error parsing JSON:', error);
              }
            }
          });
        }
      } else {
        setConversation((prev) => [...prev, { sender: 'bot', text: 'Sorry, I could not fetch the response at this time.' }]);
      }
    } catch (error) {
      console.error('Error fetching response:', error);
      setConversation((prev) => [...prev, { sender: 'bot', text: 'Sorry, I could not fetch the response at this time.' }]);
    } finally {
      setLoading(false);
    }
  };

  // handle the hardcoded/ beta responses
  const handleHardcodedResponse = async (question: string) => {
    if (hardcodedStep === 0) {
      setConversation((prev) => [
        ...prev,
        { sender: 'bot', text: 'How many credits are you taking?' },
      ]);
      setHardcodedStep(1);
    } else if (hardcodedStep === 1) {
      const credits = parseInt(question);
      if (isNaN(credits) || credits < 1) {
        setConversation((prev) => [
          ...prev,
          { sender: 'bot', text: 'Please enter a valid number of credits.' },
        ]);
        setLoading(false);
        return;
      }
      setCredits(credits);
      setConversation((prev) => [
        ...prev,
        { sender: 'bot', text: 'Are you an in-state resident? (yes/no)' },
      ]);
      setHardcodedStep(2);
    } else if (hardcodedStep === 2) {
      const resident = question.toLowerCase() === 'yes';
      setIsResident(resident);
      const tuition = calculateTuition(credits, resident);
      setConversation((prev) => [
        ...prev,
        { sender: 'bot', text: `Your tuition is $${tuition.toLocaleString()}.` },
      ]);
      setHardcodedStep(0);
    }

    setLoading(false);
  };

  // calculate the tuition based on the credits and residency
  const calculateTuition = (credits: number, isResident: boolean): number => {
    const tuitionRates = {
      resident: [1040, 1471, 1888, 2305, 2722, 3139, 3556, 3973, 4390],
      nonResident: [3076, 4500, 5924, 7348, 8772, 10196, 11620, 13044, 14468],
    };
    const rateArray = isResident ? tuitionRates.resident : tuitionRates.nonResident;
    if (credits >= 10) return rateArray[8];
    return rateArray[credits - 1];
  };

  // handle the suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    if(loading) return;
    setQuestion(suggestion);
  };

  // gets the quality data from the backend
  const fetchQualityData = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/sheet-data');
      setQualityData(response.data);
    } catch (error) {
      console.error('Error fetching quality data:', error);
    }
  };

  // open and close the modal
  const openModal = () => {
    fetchQualityData();
    setIsModalOpen(true);
  };

  const openDonate = () => {
    setDonateOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);
  const closeDonate = () => setDonateOpen(false);

  // render the chatbot component
  return (
    <div className="chatbot-container">
      <div className="chat-header">
        <img src={logo} alt="ChatBot Logo" className="chat-logo" />
        <h1>UW ChatBot</h1>
        <button className="donate-button" onClick={openDonate}>
          Donate
        </button>
        <button className="quality-button" onClick={openModal}>
        View Quality Metrics
      </button>

      <Modal isOpen={isDonateOpen} onClose={closeDonate}>
        <h2>Please donate to us 😭</h2>
        <img className="payment-photo" src={payment} alt="Donation image" />
      </Modal>

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <h2>Chatbot Quality Metrics</h2>
        <ul>
          <li><strong>Accuracy:</strong> {qualityData.accuracy || 'N/A'}</li>
          <li><strong>Completeness:</strong> {qualityData.completeness || 'N/A'}</li>
          <li><strong>Speed:</strong> {qualityData.speed || 'N/A'}</li>
          <li><strong>Error Handling:</strong> {qualityData.errorHandling || 'N/A'}</li>
        </ul>
      </Modal>
      </div>
      <div className="chat-body">
        <div className="chat-history">
          {conversation.map((msg, idx) => (
            <div key={idx} className={`message ${msg.sender}`}>
              <p>{msg.text}</p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-form" onSubmit={handleQuestionSubmit}>
          <input
            type="text"
            placeholder="Ask me anything about UW..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading||isEndClicked}
          />
          <button type="submit" disabled={loading || isEndClicked}>➤</button>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'ChatGPT' | 'Hardcoded' | 'AWS')}
            className="model-select-dropdown"
            disabled={loading || isEndClicked}
          >
            <option value="AWS">UW ChatBot</option>
            <option value="ChatGPT">ChatGPT</option>
            <option value="Hardcoded">Beta</option>
            
          </select>

          <button onClick={handleFeedbackSubmit} disabled={isEndClicked}>
            End
          </button>
        </form>

        <div className="suggested-questions">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={loading|| isEndClicked}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
