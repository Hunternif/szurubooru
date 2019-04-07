<div id='post-upload'>
    <form>
        <div class='dropper-container'></div>

        <div class='control-strip'>
            <input type='submit' value='Upload all' class='submit'/>

            <span class='skip-duplicates'>
                <%= ctx.makeCheckbox({
                    text: 'Skip duplicates',
                    name: 'skip-duplicates',
                    checked: false,
                }) %>
            </span>

            <%= ctx.makeTextInput({placeholder: 'Common tags', id: 'common-tags', name: 'common-tags', style: 'margin-top:1em;'}) %>

            <input type='button' value='Cancel' class='cancel'/>
        </div>

        <div class='messages'></div>

        <ul class='uploadables-container'></ul>
    </form>
</div>
