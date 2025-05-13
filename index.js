import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq ,ilike} from 'drizzle-orm';
import { todoTable } from './db/schema.js';
import  readlineSync  from 'readline-sync';
import  OpenAI  from 'openai';
  
const db = drizzle(process.env.DATABASE_URL);

const client = new OpenAI();

// Tools

async function getAllTodos() {
  const todos = await db.select().from(todoTable);
  return todos;
}

async function getTodoById(id) {
  const todo = await db
    .select()
    .from(todoTable)
    .where(eq(todoTable.id, id));
  return todo;
}
async function createTodo(todo) {
  const newTodo = await db
    .insert(todoTable)
    .values({ todo })
    .returning({
        id: todoTable.id,
    });
  return newTodo.id;
}

async function deleteTodo(id) {     
  const deletedTodo = await db
    .delete(todoTable)
    .where(eq(todoTable.id, id))
    .returning();
  return deletedTodo;
}


async function searchTodo(query) {
  const todos = await db
    .select()
    .from(todoTable)
    .where(ilike(todoTable.todo, `%{query}%`));
  return todos;
}

export {
  getAllTodos,
  getTodoById,
  createTodo,
  deleteTodo,
  searchTodo,
};

const tools = {
  getAllTodos : getAllTodos,
  searchTodo : searchTodo,
  createTodo :  createTodo,
  deleteTodo : deleteTodo,
};
 


const SYSTEM_PROMPT =  `

You are a helpful AI TO DO List assistant that helps the user to create a todo list , get the all todo list, update the todo list, search the todo list by date, search the todo list by date range, with START, PLAN, ACTION,OBSERVATION, and OUTPUT State.
wait for the user prompt and first PLAN using the avaiable tools.
After planing , Take the action using the appropriate available tools and wait for the observation based on Actions.
Once you get the observation, Return the AI Assistance basd on STSRT Prompt and Observation.
 
you can manage the task by creating, updating, deleting, and marking them as completed or uncompleted.
You can also search the task by date and date range.
You must strictly follow the JSON format in your response.

Todo DB Schema:

id: integer
todo: string
created_at: Date Time
updated_at: Date Time

Available Tools:
- getAllTodos: Returns all the todos from the database.
- createTodo(todo: string): Creates a new todo with the given string in the DB and return the todo id.
- deleteTodoById(id: string): Deletes a todo by ID in the DB.
- searchTodo(query: string): Searches for all todos matching the query string using  Ilike in the DB.

Examaple: 

START
{"type":"user","user":"Add a task for shoping groceries." }
{"type":"plan","plan":"I will try to get more conext on what user need to shop." }
{"type":"output","output":"Can you tell me what all items you need to shop?" }
{"type":"user","user":"I wnat to shop for milk, kurkutre, lays, bread, choco" }
{"type":"plan","plan":"I will use createTodo to create a new todo in DB." }
{"type":"action","function":"createTodo","input":"shoping for milk, kurkutre, lays, bread, choco " }
{"type":"observation","observation":"2" }
{"type":"output","output":"you todo has been added successfully" }

`;

const messages =  [{role: 'system', content: SYSTEM_PROMPT}];


while (true) {  
    const query = readlineSync.question('>> ');

    const userMessage = {
        type: 'user',
        user: query,
    };

    messages.push({role: 'user', content: JSON.stringify(userMessage)});

    while(true) {
        const response = await client.chat.completions.create({
            messages: messages,
            model: 'gpt-4o',
           response_format: {type: 'json_object'},
        });

       const result = response.choices[0].message.content;
       messages.push({role: 'assistant', content: result});

       console.log('\n\n-------------------START AI ASSISTANCE-------------------\n\n');
         console.log(result);
        console.log('\n\n-------------------END AI ASSISTANCE-------------------\n\n'); 

       const action = JSON.parse(result);

       if (action.type === 'action') {
           const functionName = tools[action.function];
           if(!functionName) throw new Error('Function not found');

           const observation = await functionName(action.input);

           const observationMessage = {
               type: 'observation',
               observation: observation,
           };
        messages.push({role: 'developer', content: JSON.stringify(observationMessage)});

       } else if (action.type === 'observation') {
           console.log('Observation:', action.observation);
       } else if (action.type === 'output') {
           console.log(`Output: ${action.output}`);
           break;
       } 
    }
}
