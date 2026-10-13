// Lab 16: Runnables and LCEL: the pieces every chain in labs 03-07 was made of.
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, RunnableMap, RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { getModel } from "../src/config.js";
import { buildVectorStore, formatDocs } from "../src/knowledge.js";

// 1. Any function becomes a Runnable, with invoke / batch / stream for free.
const shout = RunnableLambda.from((text: string) => text.toUpperCase());
const count = RunnableLambda.from((text: string) => text.length);
console.log("1) invoke:", await shout.invoke("quiet please"), "| batch:", await count.batch(["a", "abc", "hello"]));

// 2. .pipe() feeds one Runnable's output into the next (a RunnableSequence).
const chain = shout.pipe(count);
console.log("2) sequence:", chain.constructor.name, "->", await chain.invoke("library"));

// 3. A RunnableMap runs branches on the same input; RunnablePassthrough.assign adds keys and keeps the rest.
const stats = RunnableMap.from({ upper: shout, length: count });
console.log("3) parallel:", await stats.invoke("harbor"));
console.log("   assign:  ", await RunnablePassthrough.assign({ words: (d: { text: string }) => d.text.split(" ").length })
  .invoke({ text: "open on Sunday" }));

// 4. Types document the shapes that flow through a chain; the compiler checks them for you.
type Answer = { question: string; context: string; answer: string };

const retriever = (await buildVectorStore()).asRetriever({ k: 2 });
const prompt = ChatPromptTemplate.fromTemplate("Answer in one sentence from this context:\n{context}\n\nQuestion: {question}");
const rag = RunnableSequence.from([
  RunnableMap.from({ context: retriever.pipe(RunnableLambda.from(formatDocs)), question: new RunnablePassthrough<string>() }),
  RunnablePassthrough.assign({ answer: prompt.pipe(getModel()).pipe(new StringOutputParser()) }),
]);
const result: Answer = await rag.invoke("How much does 3D printing cost?");
console.log("\n4) RAG with the context kept:", Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.slice(0, 70)])));

// 5. Resilience: retry a flaky step, and fall back to another Runnable if it still fails.
let attempts = 0;
const flaky = RunnableLambda.from((text: string) => {
  attempts++;
  if (attempts < 3) throw new Error("temporary network problem");
  return `ok after ${attempts} attempts: ${text}`;
});
console.log("5) withRetry:", await flaky.withRetry({ stopAfterAttempt: 3 }).invoke("ping"));
const broken = RunnableLambda.from((): string => { throw new Error("division by zero"); });
console.log("   withFallbacks:", await broken.withFallbacks([RunnableLambda.from(() => "fallback answer")]).invoke("x"));

// 6. Every prompt knows which variables it needs.
console.log("6) input variables of the prompt:", prompt.inputVariables);
