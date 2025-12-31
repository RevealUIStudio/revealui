import { FlexContainer } from "reveal/ui/shells";
import { Heading, Paragraph } from "reveal/ui/text";

const FighterContent = () => {
  return (
    <>
      <FlexContainer>
        <Heading
          id=""
          as={"h1"}
          className="prose-h1 text-center text-3xl font-bold"
        >
          Fighter Content
        </Heading>
        <Paragraph className="prose-p">
          The Viking Warrior is a talented boxer who has been fighting for over
          10 years. He is known for his aggressive fighting style and has a
          reputation for being a tough opponent. The Firechicken is a
          professional mixed martial artist who has been fighting for over 15
          years. He has a background in western boxing. He has fought in various
          promotions around the yard. He is known for his technical fighting
          style and has a reputation for being a skilled and intelligent
          fighter.
        </Paragraph>
      </FlexContainer>
    </>
  );
};

export default FighterContent;
