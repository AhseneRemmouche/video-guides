// Lab 03: reusable prompts with variables, chat history and examples.
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, FewShotChatMessagePromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { getModel } from "../src/config.js";

const model = getModel();

// 1. A template with variables. formatMessages shows exactly what the model will receive.
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are the assistant of Harbor City Library's {branch}. Answer in {language}, in one sentence."],
  ["human", "{question}"],
]);
const filled = await prompt.formatMessages({ branch: "Lighthouse Branch", language: "French", question: "When is story time?" });
for (const m of filled) console.log(`${m.type.padStart(6)}: ${m.content}`);

// 2. prompt.pipe(model).pipe(parser): a chain. The parser turns the AIMessage into a plain string.
const chain = prompt.pipe(model).pipe(new StringOutputParser());
console.log("\n2) chain:", await chain.invoke({ branch: "Central Library", language: "English", question: "Do you have a maker space?" }));

// 3. MessagesPlaceholder: slot a whole conversation into the prompt.
const withHistory = ChatPromptTemplate.fromMessages([
  ["system", "You are a friendly librarian. Use the conversation so far."],
  new MessagesPlaceholder("history"),
  ["human", "{question}"],
]);
const history = [new HumanMessage("My name is Lea and I love science fiction."), new AIMessage("Nice to meet you, Lea!")];
console.log("\n3) history:", await withHistory.pipe(model).pipe(new StringOutputParser())
  .invoke({ history, question: "What's my name and favourite genre?" }));

// 4. Few-shot: show the model examples of the exact output style you want.
const examples = [
  { title: "The Quiet Engine", tag: "science fiction · adults · 2021" },
  { title: "The Little Crab Who Could", tag: "children · picture book · 2020" },
];
const fewShot = new FewShotChatMessagePromptTemplate({
  examples,
  examplePrompt: ChatPromptTemplate.fromMessages([["human", "{title}"], ["ai", "{tag}"]]),
  inputVariables: [],
});
// The examples become real human/AI message pairs that sit between the system message and the question.
const exampleMessages = await fewShot.formatMessages({});
const tagger = ChatPromptTemplate.fromMessages([
  ["system", "Reply with a short catalog tag in the same style as the examples, nothing else."],
  ...exampleMessages,
  ["human", "{title}"],
]).pipe(model).pipe(new StringOutputParser());
console.log("\n4) few-shot:", await tagger.invoke({ title: "Tides of Harbor City: A History" }));
