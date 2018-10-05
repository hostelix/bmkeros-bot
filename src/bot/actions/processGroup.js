import { User, Group, Session } from 'database/models';
import { JsonEncode, JsonDecode } from 'utils/json';

const manageMyGroups = async (bot, context) => {

    const { session, message } = context;

    const groups = await Group.findAll({ where: { owner_id: session.user_id }, attributes: ['id', 'name'] });

    const buttons = groups.map(g => {
        return { text: g.name, callback_data: `group@open_group:${g.id}`};
    });

    bot.sendMessage(message.chat.id, 'Choose a group!', {
        reply_markup: JSON.stringify({
            inline_keyboard: [buttons],
        }),
    });
};

const manageGroups = async (bot, user, chat_id) => {
    const groups = await user.getGroups({ attributes: ['name'] });
    const buttons = groups.map(g => ({ text: g.name, callback_data: '/groups' }))

    if(groups.length > 0) {
        bot.sendMessage(chat_id, 'Choose a group!', {
            reply_markup: JSON.stringify({
                inline_keyboard: [buttons],
            }),
        });
    } else {
        bot.sendMessage(chat_id, 'You are not a member of any group');
    }

};

const manageNewGroup = async (bot, user, chat_id) => {
    const [session]  = await Session.findOrCreate({
        where: { user_id: user.id },
    });
    let data = {
        command: 'new_group',
        user_id: user.id,
    };

    await session.update({ data, user_id: user.id });

    bot.sendMessage(chat_id, 'Write the group\'s name');
};

const getHandle = (command) => {
    const actions = {
        '/newgroup': manageNewGroup,
        '/groups': manageGroups,
        '/mygroups': manageMyGroups,
        'default': () => console.log('action not found'),
    };

    return actions[command] || actions['default'];
};

const processGroup = (bot, redis) => {
    return async (message) => {

        const context = {};
        const session_key = `key_${message.chat.id}_${message.from.id}`;
        const data = await redis.getAsync(session_key);
        const session = JsonDecode(data);

        if(session == null){
            const user = await User.findOne({ where: { chat_id: message.from.id }});
            const data = {
                user_id: user.id,
                chat_id: user.chat_id,
            };
            session = data;
            redis.setAsync(session_key, JsonEncode(data));
        }

        context['session'] = session;
        context['message'] = message;
        const chat_id = 1;
        const handle = getHandle(message.text);

        handle(bot, context, chat_id);
    };
};

export default processGroup;

