import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom';

function CreateEdition() {

    const {text_id} = useParams();
    const [params]= useSearchParams();
    const type = params.get('type');
    const edition_id = params.get('edition_id');

    

  return (
    <div>
    {type}
    {edition_id}
    {text_id}
    </div>
  )
}

export default CreateEdition
